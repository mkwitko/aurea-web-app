import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { TextField } from '@/components/form/TextField';
import { TextAreaField } from '@/components/form/TextAreaField';
import { SelectField } from '@/components/form/SelectField';
import { errorMessage } from '@/lib/zod-errors';
import { PRICING_MODEL_OPTIONS, PRODUCT_STATUS_OPTIONS } from '@/lib/enums';
import type { Product } from '@/types/business-context';

interface ProductCardProps {
  product: Product;
  update: (patch: Partial<Product>) => void;
  index: number;
  errors?: FieldErrors<Product>;
}

export function ProductCard({ product, update, errors }: ProductCardProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <TextField
        htmlFor={`product-name-${product.id}`}
        label={t('wizard.products.productName')}
        help={t('wizard.products.help.productName')}
        helpTitle={t('wizard.products.help.productNameTitle')}
        value={product.name}
        onChange={(v) => update({ name: v })}
        placeholder={t('wizard.products.placeholder.productName')}
        error={errorMessage(t, errors?.name)}
      />

      <TextAreaField
        htmlFor={`product-desc-${product.id}`}
        label={t('wizard.products.description')}
        help={t('wizard.products.help.description')}
        helpTitle={t('wizard.products.help.descriptionTitle')}
        value={product.description}
        onChange={(v) => update({ description: v })}
        placeholder={t('wizard.products.placeholder.description')}
        rows={3}
        error={errorMessage(t, errors?.description)}
      />

      <TextField
        htmlFor={`product-audience-${product.id}`}
        label={t('wizard.products.targetAudience')}
        help={t('wizard.products.help.targetAudience')}
        helpTitle={t('wizard.products.help.targetAudienceTitle')}
        value={product.targetAudience}
        onChange={(v) => update({ targetAudience: v })}
        placeholder={t('wizard.products.placeholder.targetAudience')}
        error={errorMessage(t, errors?.targetAudience)}
      />

      <TextAreaField
        htmlFor={`product-diff-${product.id}`}
        label={t('wizard.products.keyDifferentiator')}
        help={t('wizard.products.help.differentiator')}
        helpTitle={t('wizard.products.help.differentiatorTitle')}
        value={product.differentiator}
        onChange={(v) => update({ differentiator: v })}
        placeholder={t('wizard.products.placeholder.differentiator')}
        rows={2}
        error={errorMessage(t, errors?.differentiator)}
      />

      <div className="grid grid-cols-2 gap-4">
        <SelectField
          htmlFor={`product-pricing-${product.id}`}
          label={t('wizard.products.pricingModel')}
          help={t('wizard.products.help.pricingModel')}
          helpTitle={t('wizard.products.help.pricingModelTitle')}
          value={product.pricingModel}
          onChange={(v) => update({ pricingModel: v })}
          options={PRICING_MODEL_OPTIONS}
          placeholder={t('wizard.products.pricingModelSelect')}
          clearLabel={t('wizard.products.pricingModelSelect')}
          translate={t}
          error={errorMessage(t, errors?.pricingModel)}
        />
        <TextField
          htmlFor={`product-price-${product.id}`}
          label={t('wizard.products.pricePoint')}
          help={t('wizard.products.help.pricePoint')}
          helpTitle={t('wizard.products.help.pricePointTitle')}
          value={product.pricePoint}
          onChange={(v) => update({ pricePoint: v })}
          placeholder={t('wizard.products.placeholder.pricePoint')}
          error={errorMessage(t, errors?.pricePoint)}
        />
      </div>

      <SelectField
        htmlFor={`product-status-${product.id}`}
        label={t('wizard.products.status')}
        help={t('wizard.products.help.status')}
        helpTitle={t('wizard.products.help.statusTitle')}
        value={product.status}
        onChange={(v) => update({ status: v })}
        options={PRODUCT_STATUS_OPTIONS}
        translate={t}
        error={errorMessage(t, errors?.status)}
      />
    </div>
  );
}
